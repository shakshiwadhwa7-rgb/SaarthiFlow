import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase client initialization (resilient dynamic load)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

let isSupabaseConfigured = false;
let supabase = null;

if (supabaseUrl && supabaseKey && supabaseUrl !== 'https://your-project.supabase.co') {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(supabaseUrl, supabaseKey);
    isSupabaseConfigured = true;
    console.log('[DB] Connecting to Supabase PostgreSQL at:', supabaseUrl);
  } catch (err) {
    console.warn('[DB] Supabase package not installed or unreachable, using local database.');
  }
}

if (!isSupabaseConfigured) {
  console.log('[DB] Using local persistent database storage (server/data/db.json).');
}

export { isSupabaseConfigured, supabase };

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
  if (isSupabaseConfigured && supabase) {
    let query = supabase.from('tasks').select('*').order('due', { ascending: true });
    if (filter.status && filter.status !== 'All') query = query.eq('status', filter.status);
    if (filter.priority && filter.priority !== 'All') query = query.eq('priority', filter.priority);
    if (filter.project && filter.project !== 'All') query = query.eq('project', filter.project);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  const db = readLocalDb();
  let list = db.tasks || [];
  if (filter.status && filter.status !== 'All') list = list.filter(t => t.status === filter.status);
  if (filter.priority && filter.priority !== 'All') list = list.filter(t => t.priority === filter.priority);
  if (filter.project && filter.project !== 'All') list = list.filter(t => t.project === filter.project);
  return list.sort((a, b) => (a.due || '').localeCompare(b.due || ''));
}

export async function getTaskById(id) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }
  const db = readLocalDb();
  return (db.tasks || []).find(t => t.id === id) || null;
}

export async function createTask(taskData) {
  const item = {
    id: genId('t'),
    title: String(taskData.title || '').trim(),
    project: String(taskData.project || 'General').trim(),
    priority: taskData.priority || 'Medium',
    status: taskData.status || 'todo',
    due: taskData.due || '2026-11-20',
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('tasks').insert([item]).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  const db = readLocalDb();
  db.tasks = [item, ...(db.tasks || [])];
  writeLocalDb(db);
  return item;
}

export async function updateTask(id, patch) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  const db = readLocalDb();
  const idx = (db.tasks || []).findIndex(t => t.id === id);
  if (idx === -1) throw new Error(`Task ${id} not found`);
  db.tasks[idx] = { ...db.tasks[idx], ...patch, updated_at: new Date().toISOString() };
  writeLocalDb(db);
  return db.tasks[idx];
}

export async function deleteTask(id) {
  if (isSupabaseConfigured && supabase) {
    const existing = await getTaskById(id);
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return existing || { id };
  }

  const db = readLocalDb();
  const existing = (db.tasks || []).find(t => t.id === id);
  if (!existing) throw new Error(`Task ${id} not found`);
  db.tasks = db.tasks.filter(t => t.id !== id);
  writeLocalDb(db);
  return existing;
}

// ==========================================
// PROJECTS OPERATIONS
// ==========================================

export async function getProjects() {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('projects').select('*');
    if (error) throw new Error(error.message);
    return data || [];
  }
  const db = readLocalDb();
  return db.projects || [];
}

export async function createProject(name) {
  const item = { id: genId('p'), name: String(name || '').trim() };
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('projects').insert([item]).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  const db = readLocalDb();
  db.projects = [...(db.projects || []), item];
  writeLocalDb(db);
  return item;
}

// ==========================================
// PROPOSALS OPERATIONS
// ==========================================

export async function getProposals(statusFilter) {
  if (isSupabaseConfigured && supabase) {
    let query = supabase.from('proposals').select('*').order('created_at', { ascending: false });
    if (statusFilter && statusFilter !== 'All') query = query.eq('status', statusFilter);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(p => ({
      ...p,
      created: new Date(p.created_at).getTime()
    }));
  }

  const db = readLocalDb();
  let list = db.proposals || [];
  if (statusFilter && statusFilter !== 'All') {
    list = list.filter(p => p.status === statusFilter);
  }
  return list.map(p => ({
    ...p,
    created: p.created || new Date(p.created_at || Date.now()).getTime()
  }));
}

export async function getProposalById(id) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('proposals').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }
  const db = readLocalDb();
  return (db.proposals || []).find(p => p.id === id) || null;
}

export async function createProposal(prop) {
  const proposal = {
    id: prop.id || genId('prop'),
    title: String(prop.title || 'Untitled Proposal').trim(),
    source: prop.source || 'Chrome Extension',
    url: prop.url || '',
    summary: prop.summary || '',
    status: 'pending',
    tasks: Array.isArray(prop.tasks) ? prop.tasks : [],
    created_at: new Date().toISOString(),
    created: Date.now(),
    decided_at: null,
    execution_result: null
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('proposals').insert([proposal]).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  const db = readLocalDb();
  db.proposals = [proposal, ...(db.proposals || [])];
  writeLocalDb(db);
  return proposal;
}

export async function updateProposal(id, patch) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('proposals').update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  const db = readLocalDb();
  const idx = (db.proposals || []).findIndex(p => p.id === id);
  if (idx === -1) throw new Error(`Proposal ${id} not found`);
  db.proposals[idx] = { ...db.proposals[idx], ...patch, updated_at: new Date().toISOString() };
  writeLocalDb(db);
  return db.proposals[idx];
}

export async function decideProposal(id, ok, editedTasks) {
  const proposal = await getProposalById(id);
  if (!proposal) throw new Error(`Proposal with ID ${id} not found`);
  if (proposal.status !== 'pending') throw new Error(`Proposal ${id} has already been ${proposal.status}.`);

  const actionList = Array.isArray(editedTasks) && editedTasks.length > 0 ? editedTasks : proposal.tasks;

  if (!ok) {
    const rejectedUpdate = {
      status: 'rejected',
      tasks: actionList,
      decided_at: new Date().toISOString(),
      execution_result: { executed: false, reason: 'Proposal rejected by user' }
    };
    await updateProposal(id, rejectedUpdate);
    await logActivity({
      type: 'Approval',
      title: `Rejected: ${proposal.title}`,
      detail: 'No tasks created',
      source: 'Approvals',
      status: 'Rejected'
    });
    return { success: true, status: 'rejected', proposalId: id, createdTasks: [] };
  }

  const createdTasks = [];
  for (const t of actionList) {
    const created = await createTask({
      title: t.title,
      project: t.project || 'General',
      priority: t.priority || 'Medium',
      status: 'todo',
      due: t.due || '2026-11-20'
    });
    createdTasks.push(created);
  }

  const approvedUpdate = {
    status: 'approved',
    tasks: actionList,
    decided_at: new Date().toISOString(),
    execution_result: { executed: true, tasksCreated: createdTasks.length }
  };
  await updateProposal(id, approvedUpdate);

  await logActivity({
    type: 'Approval',
    title: `Approved: ${proposal.title}`,
    detail: `${createdTasks.length} tasks created in My Space`,
    source: 'Approvals',
    status: 'Completed'
  });

  return { success: true, status: 'approved', proposalId: id, createdTasks };
}

// ==========================================
// ACTIVITY LOGS
// ==========================================

export async function getActivity(filter = {}) {
  if (isSupabaseConfigured && supabase) {
    let query = supabase.from('activity_logs').select('*').order('timestamp', { ascending: false });
    if (filter.status && filter.status !== 'All') query = query.eq('status', filter.status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(a => ({ ...a, at: new Date(a.timestamp).getTime() }));
  }

  const db = readLocalDb();
  let list = db.activity_logs || [];
  if (filter.status && filter.status !== 'All') list = list.filter(a => a.status === filter.status);
  return list
    .map(a => ({ ...a, at: a.at || new Date(a.timestamp || Date.now()).getTime() }))
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

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('activity_logs').insert([item]);
    if (error) console.error('[DB] Failed to log activity to Supabase:', error.message);
    return item;
  }

  const db = readLocalDb();
  db.activity_logs = [item, ...(db.activity_logs || [])];
  writeLocalDb(db);
  return item;
}

// ==========================================
// AGENT RUNS & SETTINGS & ANALYTICS
// ==========================================

export async function getAgentRuns() {
  if (isSupabaseConfigured && supabase) {
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

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('agent_runs').insert([item]).select().single();
    if (error) console.error('[DB] Failed to create agent run in Supabase:', error.message);
    return data || item;
  }

  const db = readLocalDb();
  db.agent_runs = [item, ...(db.agent_runs || [])];
  writeLocalDb(db);
  return item;
}

export async function getSettings() {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 'default').maybeSingle();
    if (error) throw new Error(error.message);
    return data?.data || INITIAL_DATA.settings;
  }
  const db = readLocalDb();
  return db.settings || INITIAL_DATA.settings;
}

export async function saveSettings(settings) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('settings').upsert({ id: 'default', data: settings, updated_at: new Date().toISOString() }).select().single();
    if (error) throw new Error(error.message);
    return data.data;
  }
  const db = readLocalDb();
  db.settings = { ...db.settings, ...settings };
  writeLocalDb(db);
  return db.settings;
}

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
    if (priorityCounts[t.priority] !== undefined) priorityCounts[t.priority]++;
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
