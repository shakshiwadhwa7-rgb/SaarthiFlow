import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase client initialization (if configured)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

if (isSupabaseConfigured) {
  console.log('[DB] Connecting to Supabase PostgreSQL at:', supabaseUrl);
} else {
  console.log('[DB] Supabase credentials not found in environment. Using local persistent database storage.');
}

// Local persistent file fallback (data/db.json)
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const INITIAL_DATA = {
  tasks: [
    { id: 't-1', title: 'Submit GSSoC application', project: 'Open Source', priority: 'High', status: 'todo', due: '2026-11-18', created_at: new Date().toISOString() },
    { id: 't-2', title: 'Complete Azure AI-900 practice', project: 'Learning', priority: 'Medium', status: 'done', due: '2026-11-12', created_at: new Date().toISOString() },
    { id: 't-3', title: 'Build SaarthiFlow MVP', project: 'Hackathon', priority: 'High', status: 'doing', due: '2026-11-20', created_at: new Date().toISOString() },
    { id: 't-4', title: 'Paper review for agents', project: 'Research', priority: 'Medium', status: 'todo', due: '2026-11-22', created_at: new Date().toISOString() },
    { id: 't-5', title: 'HackOWASP registration', project: 'Hackathon', priority: 'High', status: 'todo', due: '2026-11-17', created_at: new Date().toISOString() },
    { id: 't-6', title: 'Infosys Internship Course', project: 'Internships', priority: 'Low', status: 'doing', due: '2026-11-25', created_at: new Date().toISOString() },
    { id: 't-7', title: 'DBMS Phase 2 submission', project: 'College', priority: 'High', status: 'todo', due: '2026-12-02', created_at: new Date().toISOString() },
    { id: 't-8', title: 'Prepare demo video', project: 'Hackathon', priority: 'Medium', status: 'todo', due: '2026-11-19', created_at: new Date().toISOString() }
  ],
  projects: [
    { id: 'p-1', name: 'Hackathon' },
    { id: 'p-2', name: 'Open Source' },
    { id: 'p-3', name: 'Learning' },
    { id: 'p-4', name: 'College' },
    { id: 'p-5', name: 'Internships' },
    { id: 'p-6', name: 'Research' }
  ],
  proposals: [
    {
      id: 'prop-1',
      title: 'Analyze HackOWASP hackathon page',
      source: 'Agent Studio',
      status: 'pending',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      tasks: [
        { id: 'p-task-1', title: 'Register team for HackOWASP', priority: 'High', due: '2026-11-17', project: 'Hackathon', actionType: 'create_task' },
        { id: 'p-task-2', title: 'Draft problem statement', priority: 'Medium', due: '2026-11-21', project: 'Hackathon', actionType: 'create_task' }
      ]
    }
  ],
  agent_runs: [],
  activity_logs: [
    {
      id: 'act-1',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      type: 'Plan',
      title: 'Analyzed webpage',
      detail: 'Extracted deadlines and requirements',
      source: 'Agent Studio',
      status: 'Completed'
    }
  ],
  settings: {
    name: 'Riya',
    email: 'riya@example.com',
    role: 'Student Developer',
    weekStart: 'Mon',
    notify: true,
    demo: false
  }
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readLocalDb() {
  ensureDir(DATA_DIR);
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DATA, null, 2), 'utf-8');
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[DB] Failed reading db.json, repairing...', err);
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DATA, null, 2), 'utf-8');
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }
}

function writeLocalDb(data) {
  ensureDir(DATA_DIR);
  const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, DB_FILE);
}

export function genId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ==========================================
// TASKS OPERATIONS
// ==========================================

export async function getTasks(filter = {}) {
  if (isSupabaseConfigured) {
    let query = supabase.from('tasks').select('*').order('due', { ascending: true });
    if (filter.status && filter.status !== 'All') query = query.eq('status', filter.status);
    if (filter.priority && filter.priority !== 'All') query = query.eq('priority', filter.priority);
    if (filter.project && filter.project !== 'All') query = query.eq('project', filter.project);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  const db = readLocalDb();
  let tasks = [...(db.tasks || [])];
  if (filter.status && filter.status !== 'All') tasks = tasks.filter(t => t.status === filter.status);
  if (filter.priority && filter.priority !== 'All') tasks = tasks.filter(t => t.priority === filter.priority);
  if (filter.project && filter.project !== 'All') tasks = tasks.filter(t => t.project === filter.project);
  return tasks.sort((a, b) => (a.due || '').localeCompare(b.due || ''));
}

export async function getTaskById(id) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }
  const db = readLocalDb();
  return db.tasks.find(t => t.id === id) || null;
}

export async function createTask(taskData) {
  const newTask = {
    id: taskData.id || genId('task'),
    title: String(taskData.title || '').trim(),
    project: String(taskData.project || 'General').trim(),
    priority: ['High', 'Medium', 'Low'].includes(taskData.priority) ? taskData.priority : 'Medium',
    status: ['todo', 'doing', 'done'].includes(taskData.status) ? taskData.status : 'todo',
    due: taskData.due || new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (!newTask.title) throw new Error('Task title cannot be empty');

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('tasks').insert([newTask]).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  const db = readLocalDb();
  db.tasks = [newTask, ...(db.tasks || [])];
  writeLocalDb(db);
  return newTask;
}

export async function updateTask(id, patch) {
  if (isSupabaseConfigured) {
    const updates = { ...patch, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  const db = readLocalDb();
  const idx = db.tasks.findIndex(t => t.id === id);
  if (idx === -1) throw new Error(`Task with ID ${id} not found`);

  db.tasks[idx] = {
    ...db.tasks[idx],
    ...patch,
    updated_at: new Date().toISOString()
  };
  writeLocalDb(db);
  return db.tasks[idx];
}

export async function deleteTask(id) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('tasks').delete().eq('id', id).select().maybeSingle();
    if (error) throw new Error(error.message);
    return data || { id };
  }

  const db = readLocalDb();
  const existing = db.tasks.find(t => t.id === id);
  if (!existing) throw new Error(`Task with ID ${id} not found`);

  db.tasks = db.tasks.filter(t => t.id !== id);
  writeLocalDb(db);
  return existing;
}

// ==========================================
// PROJECTS OPERATIONS
// ==========================================

export async function getProjects() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('projects').select('*').order('name');
    if (error) throw new Error(error.message);
    return data || [];
  }
  const db = readLocalDb();
  return db.projects || [];
}

export async function createProject(name) {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('Project name cannot be empty');

  if (isSupabaseConfigured) {
    const newProj = { id: genId('proj'), name: clean };
    const { data, error } = await supabase.from('projects').insert([newProj]).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  const db = readLocalDb();
  const exists = (db.projects || []).find(p => p.name.toLowerCase() === clean.toLowerCase());
  if (exists) return exists;

  const newProj = { id: genId('proj'), name: clean };
  db.projects = [...(db.projects || []), newProj];
  writeLocalDb(db);
  return newProj;
}

// ==========================================
// ACTION PROPOSALS & APPROVAL EXECUTION
// ==========================================

export async function getProposals(status) {
  if (isSupabaseConfigured) {
    let query = supabase.from('proposals').select('*').order('created_at', { ascending: false });
    if (status && status !== 'All') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(p => ({
      ...p,
      tasks: typeof p.tasks === 'string' ? JSON.parse(p.tasks) : (p.tasks || [])
    }));
  }

  const db = readLocalDb();
  let list = db.proposals || [];
  if (status && status !== 'All') list = list.filter(p => p.status === status);
  return list.sort((a, b) => new Date(b.created_at || b.created || 0) - new Date(a.created_at || a.created || 0));
}

export async function getProposalById(id) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('proposals').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      ...data,
      tasks: typeof data.tasks === 'string' ? JSON.parse(data.tasks) : (data.tasks || [])
    };
  }

  const db = readLocalDb();
  return (db.proposals || []).find(p => p.id === id) || null;
}

export async function createProposal(prop) {
  const proposal = {
    id: prop.id || genId('prop'),
    title: String(prop.title || 'Untitled Proposal').trim(),
    source: prop.source || 'Agent Studio',
    status: 'pending',
    tasks: Array.isArray(prop.tasks) ? prop.tasks : [],
    created_at: new Date().toISOString(),
    decided_at: null,
    execution_result: null
  };

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('proposals').insert([proposal]).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  const db = readLocalDb();
  db.proposals = [proposal, ...(db.proposals || [])];
  writeLocalDb(db);
  return proposal;
}

export async function updateProposal(id, updates) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('proposals').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  const db = readLocalDb();
  const idx = db.proposals.findIndex(p => p.id === id);
  if (idx === -1) throw new Error(`Proposal with ID ${id} not found`);

  db.proposals[idx] = { ...db.proposals[idx], ...updates };
  writeLocalDb(db);
  return db.proposals[idx];
}

/**
 * Execute or reject an action proposal with transactional/idempotent processing.
 * Strictly prevents double execution and validates all actions before execution.
 */
export async function decideProposal(id, ok, editedTasks) {
  const proposal = await getProposalById(id);
  if (!proposal) {
    throw new Error(`Proposal with ID ${id} not found`);
  }

  if (proposal.status !== 'pending') {
    throw new Error(`Proposal ${id} has already been ${proposal.status} and cannot be processed again.`);
  }

  const actionList = Array.isArray(editedTasks) && editedTasks.length > 0 ? editedTasks : proposal.tasks;

  // Case 1: Rejection
  if (!ok) {
    const rejectedUpdate = {
      status: 'rejected',
      tasks: actionList,
      decided_at: new Date().toISOString(),
      execution_result: {
        executed: false,
        reason: 'Proposal rejected by user',
        actionsCount: 0
      }
    };

    await updateProposal(id, rejectedUpdate);

    await logActivity({
      type: 'Approval',
      title: `Rejected plan: ${proposal.title}`,
      detail: 'No tasks or actions were executed',
      source: 'Approvals',
      status: 'Rejected'
    });

    return {
      success: true,
      status: 'rejected',
      message: 'Proposal successfully rejected with zero database mutations',
      executedActions: []
    };
  }

  // Case 2: Approval & Real Database Execution
  const executionResults = [];
  let successCount = 0;
  let failureCount = 0;

  for (const action of actionList) {
    const actionType = action.actionType || 'create_task';
    const resultItem = {
      actionType,
      title: action.title,
      success: false,
      error: null,
      taskId: action.id || action.targetTaskId || null
    };

    try {
      if (actionType === 'create_task') {
        const created = await createTask({
          title: action.title,
          project: action.project || 'General',
          priority: action.priority || 'Medium',
          status: action.status || 'todo',
          due: action.due || new Date().toISOString().slice(0, 10)
        });
        resultItem.success = true;
        resultItem.taskId = created.id;
        successCount++;
      } else if (actionType === 'update_task' || actionType === 'reschedule_task') {
        const targetId = action.targetTaskId || action.id;
        if (!targetId) throw new Error('Missing target task ID for update action');
        const updated = await updateTask(targetId, {
          ...(action.title ? { title: action.title } : {}),
          ...(action.project ? { project: action.project } : {}),
          ...(action.priority ? { priority: action.priority } : {}),
          ...(action.due ? { due: action.due } : {}),
          ...(action.status ? { status: action.status } : {})
        });
        resultItem.success = true;
        resultItem.taskId = updated.id;
        successCount++;
      } else if (actionType === 'complete_task') {
        const targetId = action.targetTaskId || action.id;
        if (!targetId) throw new Error('Missing target task ID to mark complete');
        const completed = await updateTask(targetId, { status: 'done' });
        resultItem.success = true;
        resultItem.taskId = completed.id;
        successCount++;
      } else if (actionType === 'delete_task') {
        const targetId = action.targetTaskId || action.id;
        if (!targetId) throw new Error('Missing target task ID for deletion');
        await deleteTask(targetId);
        resultItem.success = true;
        successCount++;
      } else {
        throw new Error(`Unsupported action type: ${actionType}`);
      }
    } catch (err) {
      resultItem.error = err.message;
      failureCount++;
      console.error(`[EXECUTION_ERROR] Failed action ${actionType}:`, err.message);
    }

    executionResults.push(resultItem);
  }

  // Update proposal state
  const executionSummary = {
    executed: true,
    totalActions: actionList.length,
    successCount,
    failureCount,
    results: executionResults,
    executedAt: new Date().toISOString()
  };

  await updateProposal(id, {
    status: 'approved',
    tasks: actionList,
    decided_at: new Date().toISOString(),
    execution_result: executionSummary
  });

  // Log activity
  await logActivity({
    type: 'Approval',
    title: `Approved & Executed: ${proposal.title}`,
    detail: `${successCount} actions completed, ${failureCount} failed`,
    source: 'Approvals',
    status: failureCount === 0 ? 'Completed' : 'Pending'
  });

  return {
    success: true,
    status: 'approved',
    summary: executionSummary,
    results: executionResults
  };
}

// ==========================================
// ACTIVITY LOGS
// ==========================================

export async function getActivity(filter = {}) {
  if (isSupabaseConfigured) {
    let query = supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(100);
    if (filter.status && filter.status !== 'All') query = query.eq('status', filter.status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(a => ({
      ...a,
      at: new Date(a.timestamp).getTime()
    }));
  }

  const db = readLocalDb();
  let list = db.activity_logs || [];
  if (filter.status && filter.status !== 'All') list = list.filter(a => a.status === filter.status);
  return list
    .map(a => ({
      ...a,
      at: a.at || new Date(a.timestamp || Date.now()).getTime()
    }))
    .sort((a, b) => b.at - a.at);
}

export async function logActivity({ type, title, detail, source, status = 'Completed' }) {
  const item = {
    id: genId('act'),
    type: type || 'Task',
    title: String(title || '').trim(),
    detail: String(detail || '').trim(),
    source: source || 'System',
    status,
    timestamp: new Date().toISOString(),
    at: Date.now()
  };

  if (isSupabaseConfigured) {
    const { error } = await supabase.from('activity_logs').insert([{
      id: item.id,
      type: item.type,
      title: item.title,
      detail: item.detail,
      source: item.source,
      status: item.status,
      timestamp: item.timestamp
    }]);
    if (error) console.error('[DB] Failed to log activity to Supabase:', error.message);
    return item;
  }

  const db = readLocalDb();
  db.activity_logs = [item, ...(db.activity_logs || [])];
  writeLocalDb(db);
  return item;
}

// ==========================================
// AGENT RUNS
// ==========================================

export async function getAgentRuns() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('agent_runs').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }
  const db = readLocalDb();
  return db.agent_runs || [];
}

export async function createAgentRun(runData) {
  const item = {
    id: runData.id || genId('run'),
    command: runData.command,
    status: runData.status || 'completed',
    raw_input: runData.raw_input || '',
    output_summary: runData.output_summary || '',
    proposal_id: runData.proposal_id || null,
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('agent_runs').insert([item]).select().single();
    if (error) console.error('[DB] Failed to create agent run in Supabase:', error.message);
    return data || item;
  }

  const db = readLocalDb();
  db.agent_runs = [item, ...(db.agent_runs || [])];
  writeLocalDb(db);
  return item;
}

// ==========================================
// USER SETTINGS
// ==========================================

export async function getSettings() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 'default').maybeSingle();
    if (error) throw new Error(error.message);
    return data?.data || INITIAL_DATA.settings;
  }

  const db = readLocalDb();
  return db.settings || INITIAL_DATA.settings;
}

export async function saveSettings(settings) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('settings').upsert({ id: 'default', data: settings, updated_at: new Date().toISOString() }).select().single();
    if (error) throw new Error(error.message);
    return data.data;
  }

  const db = readLocalDb();
  db.settings = { ...db.settings, ...settings };
  writeLocalDb(db);
  return db.settings;
}

// ==========================================
// ANALYTICS
// ==========================================

export async function getAnalytics() {
  const tasks = await getTasks();
  const activity = await getActivity();
  const proposals = await getProposals();

  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'done').length;
  const active = total - done;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  const priorityCounts = { High: 0, Medium: 0, Low: 0 };
  const projectStats = {};

  for (const t of tasks) {
    if (priorityCounts[t.priority] !== undefined) {
      priorityCounts[t.priority]++;
    }
    const proj = t.project || 'General';
    if (!projectStats[proj]) projectStats[proj] = { total: 0, done: 0 };
    projectStats[proj].total++;
    if (t.status === 'done') projectStats[proj].done++;
  }

  const projects = Object.entries(projectStats).map(([name, s]) => ({
    name,
    total: s.total,
    done: s.done,
    pct: s.total > 0 ? Math.round((s.done / s.total) * 100) : 0
  }));

  return {
    totalTasks: total,
    completedTasks: done,
    activeTasks: active,
    completionRate: rate,
    priorityDistribution: Object.entries(priorityCounts).map(([name, value]) => ({ name, value })),
    projectProgress: projects,
    totalActivity: activity.length,
    totalProposals: proposals.length,
    pendingProposals: proposals.filter(p => p.status === 'pending').length
  };
}
