import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ClipboardList, CheckCircle2, CalendarClock, Sparkles, Paperclip, Globe,
  CalendarDays, ListChecks, Plus, ArrowUpRight, Trash2, Pencil, ChevronLeft,
  ChevronRight, Send, Check, X, Download, Chrome, Search, Trophy,
  Activity as ActI, BarChart3, Bot, Circle, Loader2, Zap, Shield,
  MousePointerClick, AlertCircle, RefreshCw, ExternalLink
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart,
  Pie, Cell, AreaChart, Area, CartesianGrid, LineChart, Line
} from 'recharts';
import { useApp, fmtD, MONTHS, iso, TODAY, uid } from './store.jsx';
import { Card, Title, Pri, Modal, Page, Empty, TaskModal } from './ui.jsx';
import { api } from './api.js';

const COL = ['#7c3aed', '#b794f6', '#f472b6', '#e4d7ff'];
const dow = d => new Date((d || TODAY) + 'T00:00:00').getDay();
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekly = tasks => [1, 2, 3, 4, 5, 6, 0].map(i => ({
  d: DAYS[i],
  n: tasks.filter(t => dow(t.due) === i).length
}));
const groups = a => {
  const c = {};
  a.forEach(x => { c[x.type] = (c[x.type] || 0) + 1; });
  return Object.entries(c).map(([name, value]) => ({ name, value }));
};
const tm = t => {
  if (!t) return '';
  const d = typeof t === 'number' ? new Date(t) : new Date(t);
  return d.toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' });
};

const Robot = () => (
  <svg viewBox="0 0 120 120" className="h-28 w-28 drop-shadow-xl">
    <circle cx="60" cy="10" r="5" fill="#a78bfa" />
    <path d="M60 14v14" stroke="#a78bfa" strokeWidth="3" />
    <rect x="18" y="28" width="84" height="64" rx="30" fill="#fff" stroke="#d9c8ff" strokeWidth="2" />
    <rect x="28" y="40" width="64" height="40" rx="20" fill="#2a1a5e" />
    <path d="M42 58q6-8 12 0M66 58q6-8 12 0" stroke="#c4a8ff" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M52 68q8 6 16 0" stroke="#c4a8ff" strokeWidth="3" fill="none" strokeLinecap="round" />
    <rect x="8" y="52" width="10" height="18" rx="5" fill="#8b5cf6" />
    <rect x="102" y="52" width="10" height="18" rx="5" fill="#8b5cf6" />
  </svg>
);

const Check_ = ({ on, onClick }) => (
  <button
    onClick={onClick}
    aria-label="Toggle complete"
    className={'grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ' + (on ? 'border-brand-600 bg-brand-600 text-white' : 'border-brand-200 bg-white hover:border-brand-500')}
  >
    {on && <Check size={14} />}
  </button>
);

// Connection Status Banner
function StatusBanner() {
  const { backendConnected, error, refresh, loading } = useApp();
  if (backendConnected && !error) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-800 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <AlertCircle size={18} className="text-rose-600 shrink-0" />
        <span>
          <strong>Backend Offline:</strong> {error || 'Could not connect to SaarthiFlow backend.'} Ensure the server is running on port 3001.
        </span>
      </div>
      <button
        onClick={() => refresh()}
        disabled={loading}
        className="btn !bg-rose-600 !py-1 !px-3 !text-xs shrink-0"
      >
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        Retry
      </button>
    </div>
  );
}

// ==========================================
// 1. OVERVIEW
// ==========================================
export function Overview() {
  const { tasks, activity, toggleTask, settings, loading, refresh } = useApp();
  const nav = useNavigate();
  const [cmd, setCmd] = useState('');

  const active = tasks.filter(t => t.status !== 'done');
  const done = tasks.length - active.length;
  const up = active.filter(t => t.due >= TODAY).sort((a, b) => a.due.localeCompare(b.due));
  const near = up.filter(t => t.due <= '2026-11-28').length;
  const run = (c) => nav('/agent?cmd=' + encodeURIComponent(c));

  const kpi = [
    [ClipboardList, 'Active Tasks', active.length, '+20%', 1],
    [CheckCircle2, 'Completed Tasks', done, '+40%', 1],
    [CalendarClock, 'Upcoming Deadlines', near, '-17%', 0],
    [Sparkles, 'AI Actions', activity.length, '+50%', 1]
  ];
  const mine = [...tasks].sort((a, b) => (a.due || '').localeCompare(b.due || '')).slice(0, 4);
  const steps = activity.slice(0, 4);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-5">
        <StatusBanner />
        <Card className="relative flex items-center justify-between overflow-hidden !py-6">
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-100/80 via-white/0 to-brand-200/70" />
          <div>
            <h1 className="text-3xl font-extrabold md:text-4xl">Hello, {settings.name || 'Developer'}! 👋</h1>
            <p className="mt-1 text-ink/65 md:text-lg">Ready to turn your browsing into progress?</p>
          </div>
          <div className="hidden sm:block"><Robot /></div>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpi.map(([I, l, v, d, isUp], i) => (
            <Card key={l} className="hov !p-4" style={{ animationDelay: i * 60 + 'ms' }}>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-100 text-brand-600">
                  <I size={22} />
                </span>
                <div>
                  <div className="text-sm text-ink/70">{l}</div>
                  <div className="flex items-center gap-2">
                    <b className="text-3xl">{loading ? '...' : v}</b>
                    <span className={'chip ' + (isUp ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500')}>
                      {isUp ? '↑' : '↓'} {d.replace('-', '')}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <Card>
            <Title right={null}>
              Agent Command <Sparkles size={18} className="text-brand-500" />
            </Title>
            <p className="-mt-3 mb-3 text-sm text-ink/60">Tell SaarthiFlow what you want to do, and Gemini will plan the rest.</p>
            <div className="rounded-2xl border border-brand-100 bg-white/80 p-3">
              <textarea
                value={cmd}
                onChange={e => setCmd(e.target.value)}
                rows={2}
                className="w-full resize-none bg-transparent text-sm outline-none"
                placeholder="e.g. Analyze this hackathon page and create a task plan…"
              />
              <div className="flex items-center justify-between">
                <Paperclip size={18} className="text-ink/40" />
                <button className="btn" onClick={() => run(cmd || 'Analyze this hackathon page and create a task plan')}>
                  Run Agent <ArrowUpRight size={16} />
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                [Globe, 'Analyze Webpage', 'Analyze this webpage and extract deadlines'],
                [CalendarDays, 'Plan My Week', 'Plan my week'],
                [ListChecks, 'Create Checklist', 'Create a checklist for my hackathon submission']
              ].map(([I, l, c]) => (
                <button key={l} className="btn2 !py-1.5" onClick={() => run(c)}>
                  <I size={16} />{l}
                </button>
              ))}
              <Link to="/quick-actions" className="btn2 !py-1.5"><Plus size={16} />More</Link>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <h3 className="text-xl font-extrabold leading-6">Use SaarthiFlow on Any Website</h3>
            <p className="mt-2 max-w-[180px] text-sm text-ink/65">Turn hackathons, internships and events into actionable tasks in one click.</p>
            <MousePointerClick className="absolute right-4 top-12 text-brand-400" size={64} />
            <Link to="/extension" className="btn mt-5">Get Extension <ArrowUpRight size={16} /></Link>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card>
            <Title icon={ClipboardList} right={<Link className="text-sm font-semibold text-brand-600" to="/space">View All →</Link>}>
              My Tasks ({active.length})
            </Title>
            <div className="space-y-3">
              {mine.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <Check_ on={t.status === 'done'} onClick={() => toggleTask(t.id)} />
                  <span className={'min-w-0 flex-1 truncate font-medium ' + (t.status === 'done' ? 'line-through text-ink/45' : '')}>
                    {t.title}
                  </span>
                  <Pri p={t.priority} />
                  <span className="hidden text-xs text-ink/60 xl:block">{fmtD(t.due)}</span>
                </div>
              ))}
              {!mine.length && <Empty text="No active tasks in database." />}
            </div>
          </Card>

          <Card>
            <Title icon={BarChart3}>Weekly Productivity</Title>
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart data={weekly(tasks)}>
                  <XAxis dataKey="d" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={22} />
                  <Tooltip />
                  <Bar dataKey="n" name="Tasks due" fill="#b794f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <Title icon={CheckCircle2}>Action Insights</Title>
            <Donut data={groups(activity)} total={activity.length} />
          </Card>
        </div>
      </div>

      <div className="space-y-5">
        <Card>
          <Title icon={ActI}>Recent Agent Run</Title>
          <div className="space-y-4">
            {steps.map((a, i) => (
              <div key={a.id} className="flex gap-3">
                <CheckCircle2 size={20} className={i === 0 ? 'text-brand-600' : 'text-brand-400'} />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="truncate">{a.title}</span>
                    <span className="ml-2 shrink-0 text-xs font-normal text-ink/50">
                      {new Date(a.at || a.timestamp).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="truncate text-xs text-ink/55">{a.detail}</div>
                </div>
              </div>
            ))}
            {!steps.length && <Empty text="No recorded agent activity." />}
          </div>
        </Card>

        <Card>
          <Title icon={CalendarDays}>Upcoming Deadlines</Title>
          <div className="space-y-3">
            {up.slice(0, 4).map(t => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <Trophy size={18} className="text-amber-500" />
                <span className="flex-1 truncate font-medium">{t.title}</span>
                <span className="chip bg-rose-100 text-rose-500">{fmtD(t.due)}</span>
              </div>
            ))}
            {!up.length && <Empty text="No upcoming deadlines." />}
          </div>
        </Card>

        <Card>
          <Title icon={BarChart3} right={<span className="chip bg-emerald-100 text-emerald-600">+50%</span>}>
            Activity Summary
          </Title>
          <div className="h-32">
            <ResponsiveContainer>
              <AreaChart data={weekly(tasks).map(x => ({ ...x, n: x.n + 1 }))}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#a78bfa" stopOpacity=".5" />
                    <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <Tooltip />
                <Area dataKey="n" stroke="#7c3aed" fill="url(#g)" strokeWidth={2} type="monotone" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Donut({ data, total }) {
  const d = data.length ? data : [{ name: 'None', value: 1 }];
  return (
    <div>
      <div className="relative mx-auto h-36 w-36">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={d} dataKey="value" innerRadius={44} outerRadius={64} paddingAngle={2} stroke="none">
              {d.map((_, i) => (
                <Cell key={i} fill={COL[i % 4]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <b className="text-2xl">{total}</b>
            <div className="-mt-1 text-xs text-ink/60">Actions</div>
          </div>
        </div>
      </div>
      <div className="mt-2 space-y-1 text-xs">
        {data.map((x, i) => (
          <div key={x.name} className="flex items-center gap-2">
            <i className="h-2.5 w-2.5 rounded-full" style={{ background: COL[i % 4] }} />
            {x.name}
            <b className="ml-auto">{total > 0 ? Math.round((x.value / total) * 100) : 0}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// 2. AGENT STUDIO (GEMINI POWERED)
// ==========================================
const STAGES = ['Understand', 'Plan', 'Approve', 'Execute', 'Verify'];

export function Agent() {
  const { refresh, showToast } = useApp();
  const [sp] = useSearchParams();
  const nav = useNavigate();

  const [cmd, setCmd] = useState(sp.get('cmd') || '');
  const [webpageUrl, setWebpageUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [msgs, setMsgs] = useState([
    { r: 'ai', t: 'Hi! I am your SaarthiFlow Agent. Give me a command, webpage URL, or context and I will plan structured actions for your review.' }
  ]);

  const [plan, setPlan] = useState(null);
  const [proposalId, setProposalId] = useState(null);
  const [st, setSt] = useState(0); // 0: Understand, 1: Plan, 2: Approve
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [aiMode, setAiMode] = useState(null);

  useEffect(() => {
    if (sp.get('cmd')) {
      setCmd(sp.get('cmd'));
    }
  }, [sp]);

  const gen = async () => {
    if (!cmd.trim() || busy) return;
    const c = cmd.trim();
    const url = webpageUrl.trim() || undefined;

    setBusy(true);
    setSent(false);
    setSt(0);
    setMsgs(m => [...m, { r: 'me', t: `${c}${url ? ` [URL: ${url}]` : ''}` }]);
    setCmd('');

    try {
      setSt(1); // Stage: Plan
      const result = await api.generatePlan({
        command: c,
        webpageUrl: url
      });

      setPlan({
        title: c,
        summary: result.summary,
        tasks: result.tasks
      });
      setProposalId(result.proposalId);
      setAiMode(result.isSimulated ? 'Deterministic Rules' : 'Gemini 1.5 Flash');

      setMsgs(m => [
        ...m,
        {
          r: 'ai',
          t: `${result.summary} I have proposed ${result.tasks.length} actions below. You can review or edit them before sending for human approval.`
        }
      ]);

      if (result.warning) {
        showToast(result.warning, 'info');
      }
      await refresh(true);
    } catch (err) {
      setMsgs(m => [
        ...m,
        { r: 'ai', t: `Error generating plan: ${err.message}` }
      ]);
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const ed = (id, k, v) => {
    setPlan(p => ({
      ...p,
      tasks: p.tasks.map(t => (t.id === id ? { ...t, [k]: v } : t))
    }));
  };

  const send = async () => {
    if (!plan || !plan.tasks.length) return;
    try {
      if (proposalId) {
        await api.updateProposal(proposalId, { tasks: plan.tasks });
      }
      setSt(2); // Stage: Approve
      setSent(true);
      showToast('Plan submitted for Human-in-the-Loop approval!', 'success');
      setMsgs(m => [
        ...m,
        { r: 'ai', t: 'Plan successfully sent to Approvals! Open the Approvals tab to approve or reject the operations.' }
      ]);
      await refresh(true);
    } catch (err) {
      showToast(`Failed to update proposal: ${err.message}`, 'error');
    }
  };

  return (
    <Page
      title="Agent Studio"
      sub="Describe a goal and review the plan before anything happens."
      right={
        <div className="flex items-center gap-2">
          <span className="chip bg-brand-100 text-brand-700 font-semibold flex items-center gap-1.5">
            <Sparkles size={13} className="text-brand-600" />
            {aiMode ? `Active AI: ${aiMode}` : 'Agentic Workflow Ready'}
          </span>
        </div>
      }
    >
      <StatusBanner />
      <Card className="!p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {STAGES.map((s, i) => (
            <div key={s} className={'flex items-center gap-2 text-sm font-semibold ' + (i <= st ? 'text-brand-700' : 'text-ink/40')}>
              <span className={'grid h-7 w-7 place-items-center rounded-full text-xs ' + (i <= st ? 'bg-brand-600 text-white' : 'bg-brand-50')}>
                {i < st ? <Check size={14} /> : i + 1}
              </span>
              {s}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="flex min-h-[440px] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto max-h-[380px] pr-1">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ' + (m.r === 'me' ? 'ml-auto bg-brand-600 text-white' : 'bg-white/90 border border-brand-100/60')}
              >
                {m.t}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-ink/60">
                <Loader2 className="animate-spin text-brand-600" size={16} />
                Analyzing requirements & planning with Gemini…
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              'Analyze this hackathon page',
              'Plan my week',
              'Create a checklist for submission',
              'Reschedule overdue tasks'
            ].map(s => (
              <button key={s} className="btn2 !px-3 !py-1 !text-xs" onClick={() => setCmd(s)}>
                {s}
              </button>
            ))}
          </div>

          {showUrlInput && (
            <div className="mt-2 flex items-center gap-2">
              <Globe size={16} className="text-brand-600 shrink-0" />
              <input
                className="inp !py-1.5 text-xs"
                placeholder="https://example.com/hackathon (Optional public webpage URL)"
                value={webpageUrl}
                onChange={e => setWebpageUrl(e.target.value)}
              />
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              className={'btn2 !p-2 shrink-0 ' + (showUrlInput ? 'bg-brand-100 text-brand-700' : '')}
              onClick={() => setShowUrlInput(!showUrlInput)}
              title="Attach Webpage URL"
            >
              <Globe size={18} />
            </button>
            <input
              className="inp"
              value={cmd}
              onChange={e => setCmd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && gen()}
              placeholder="Tell the agent what to do…"
            />
            <button className="btn shrink-0" onClick={gen} disabled={busy || !cmd.trim()}>
              <Sparkles size={16} />
              Generate Plan
            </button>
          </div>
        </Card>

        <Card>
          <Title icon={ListChecks} right={plan?.tasks?.length ? <span className="chip bg-brand-100 text-brand-700">{plan.tasks.length} proposed</span> : null}>
            Proposed Actions
          </Title>
          {!plan ? (
            <Empty text="Generate a plan to see editable tasks and actions here." />
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-brand-50/80 p-3 text-xs text-brand-900 border border-brand-100">
                <b>Plan Summary:</b> {plan.summary}
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                {plan.tasks.map(t => (
                  <div key={t.id} className="space-y-2 rounded-2xl bg-white/70 p-3 border border-brand-100/50">
                    <div className="flex items-center gap-2">
                      <span className="chip bg-purple-100 text-purple-700 text-[10px]">
                        {t.actionType || 'create_task'}
                      </span>
                      <input
                        className="inp font-semibold text-sm flex-1"
                        value={t.title}
                        onChange={e => ed(t.id, 'title', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        className="inp !w-28 !py-1 text-xs"
                        placeholder="Project"
                        value={t.project || 'General'}
                        onChange={e => ed(t.id, 'project', e.target.value)}
                      />
                      <select
                        className="inp !w-auto !py-1 text-xs"
                        value={t.priority}
                        onChange={e => ed(t.id, 'priority', e.target.value)}
                      >
                        {['High', 'Medium', 'Low'].map(x => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                      <input
                        type="date"
                        className="inp !w-auto !py-1 text-xs"
                        value={t.due}
                        onChange={e => ed(t.id, 'due', e.target.value)}
                      />
                      <button
                        className="btn2 !px-2 !py-1 text-rose-500 ml-auto"
                        aria-label="Remove"
                        onClick={() => setPlan(p => ({ ...p, tasks: p.tasks.filter(x => x.id !== t.id) }))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {sent ? (
                <button className="btn w-full mt-3" onClick={() => nav('/approvals')}>
                  Go to Approvals <ArrowUpRight size={16} />
                </button>
              ) : (
                <button className="btn w-full mt-3" disabled={!plan.tasks.length} onClick={send}>
                  <Send size={16} />
                  Send for Human Approval
                </button>
              )}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}

// ==========================================
// 3. MY SPACE (DATABASE BACKED TASKS)
// ==========================================
export function Space() {
  const { tasks, addTask, updateTask, deleteTask, toggleTask } = useApp();
  const [sp] = useSearchParams();

  const [q, setQ] = useState(sp.get('q') || '');
  const [view, setView] = useState('list');
  const [pf, setPf] = useState('All');
  const [sf, setSf] = useState('All');
  const [m, setM] = useState(null);

  useEffect(() => {
    setQ(sp.get('q') || '');
  }, [sp]);

  const list = tasks
    .filter(t => (t.title + (t.project || '')).toLowerCase().includes(q.toLowerCase()) &&
      (pf === 'All' || t.priority === pf) &&
      (sf === 'All' || t.status === sf)
    )
    .sort((a, b) => (a.due || '').localeCompare(b.due || ''));

  const projects = useMemo(() => {
    const o = {};
    tasks.forEach(t => {
      const p = t.project || 'General';
      o[p] = o[p] || { n: 0, d: 0 };
      o[p].n++;
      if (t.status === 'done') o[p].d++;
    });
    return Object.entries(o);
  }, [tasks]);

  const Row = t => (
    <div key={t.id} className="glass hov flex flex-wrap items-center gap-3 !rounded-2xl p-3">
      <Check_ on={t.status === 'done'} onClick={() => toggleTask(t.id)} />
      <div className="min-w-0 flex-1">
        <div className={'truncate font-semibold ' + (t.status === 'done' ? 'line-through text-ink/45' : '')}>
          {t.title}
        </div>
        <div className="text-xs text-ink/55">{t.project} · due {fmtD(t.due)}</div>
      </div>
      <Pri p={t.priority} />
      <span className="chip bg-brand-100 text-brand-700">
        {{ todo: 'To do', doing: 'In progress', done: 'Done' }[t.status] || t.status}
      </span>
      <button onClick={() => setM(t)} aria-label="Edit" className="text-ink/60 hover:text-ink">
        <Pencil size={16} />
      </button>
      <button onClick={() => deleteTask(t.id)} aria-label="Delete" className="text-rose-500 hover:text-rose-700">
        <Trash2 size={16} />
      </button>
    </div>
  );

  return (
    <Page
      title="My Space"
      sub="All your persistent tasks and projects in one place."
      right={
        <button className="btn" onClick={() => setM({})}>
          <Plus size={16} />New task
        </button>
      }
    >
      <StatusBanner />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {projects.slice(0, 4).map(([p, v]) => (
          <Card key={p} className="hov !p-4">
            <b>{p}</b>
            <div className="mt-2 h-2 rounded-full bg-brand-100">
              <div
                className="h-2 rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: (v.n > 0 ? (v.d / v.n) * 100 : 0) + '%' }}
              />
            </div>
            <div className="mt-1 text-xs text-ink/60">{v.d}/{v.n} done</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="glass !rounded-xl flex flex-1 items-center gap-2 px-3">
          <Search size={16} className="text-ink/50" />
          <input
            className="w-full min-w-[140px] bg-transparent py-2 text-sm outline-none"
            placeholder="Search tasks or projects"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <select className="inp !w-auto" value={pf} onChange={e => setPf(e.target.value)}>
          {['All', 'High', 'Medium', 'Low'].map(x => (
            <option key={x} value={x}>{x === 'All' ? 'All priorities' : x}</option>
          ))}
        </select>
        <select className="inp !w-auto" value={sf} onChange={e => setSf(e.target.value)}>
          <option value="All">All statuses</option>
          <option value="todo">To do</option>
          <option value="doing">In progress</option>
          <option value="done">Done</option>
        </select>
        <div className="glass !rounded-xl flex p-1">
          {['list', 'kanban'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={'rounded-lg px-3 py-1 text-sm font-semibold ' + (view === v ? 'bg-brand-600 text-white' : '')}
            >
              {v === 'list' ? 'Task List' : 'Kanban'}
            </button>
          ))}
        </div>
      </div>

      {view === 'list' ? (
        <div className="space-y-2">
          {list.map(Row)}
          {!list.length && <Empty text="No tasks match. Create one with New task or run the Agent." />}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {[['todo', 'To do'], ['doing', 'In progress'], ['done', 'Done']].map(([s, l]) => (
            <Card key={s} className="!p-4">
              <h4 className="mb-3 font-bold flex items-center justify-between">
                <span>{l}</span>
                <span className="text-ink/45 text-xs font-normal">({list.filter(t => t.status === s).length})</span>
              </h4>
              <div className="space-y-2 min-h-[120px]">
                {list.filter(t => t.status === s).map(t => (
                  <div key={t.id} className="rounded-2xl bg-white/80 p-3 text-sm border border-brand-100/50 shadow-sm">
                    <div className="font-semibold">{t.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-ink/55">
                      <Pri p={t.priority} />
                      <span>{fmtD(t.due)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        className="inp !py-1 !text-xs !w-auto"
                        value={t.status}
                        onChange={e => updateTask({ ...t, status: e.target.value })}
                      >
                        <option value="todo">To do</option>
                        <option value="doing">In progress</option>
                        <option value="done">Done</option>
                      </select>
                      <button onClick={() => setM(t)} aria-label="Edit" className="ml-auto text-ink/50 hover:text-ink">
                        <Pencil size={14} />
                      </button>
                      <button className="text-rose-500 hover:text-rose-700" onClick={() => deleteTask(t.id)} aria-label="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {!list.some(t => t.status === s) && (
                  <div className="py-6 text-center text-xs text-ink/40 border border-dashed border-brand-100 rounded-xl">
                    No {l.toLowerCase()} tasks
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {m && (
        <TaskModal
          task={m.id ? m : null}
          onClose={() => setM(null)}
          onSave={t => (t.id ? updateTask(t) : addTask(t))}
        />
      )}
    </Page>
  );
}

// ==========================================
// 4. APPROVALS (HUMAN-IN-THE-LOOP)
// ==========================================
export function Approvals() {
  const { proposals, decide } = useApp();
  const [tab, setTab] = useState('pending');
  const [ed, setEd] = useState({});
  const [busyId, setBusyId] = useState(null);

  const list = proposals.filter(p => p.status === tab);
  const tasksOf = p => ed[p.id] || p.tasks || [];
  const chg = (p, id, k, v) => {
    setEd({
      ...ed,
      [p.id]: tasksOf(p).map(t => (t.id === id ? { ...t, [k]: v } : t))
    });
  };

  const handleDecision = async (id, ok) => {
    const p = proposals.find(x => x.id === id);
    if (!p || busyId) return;
    setBusyId(id);
    try {
      await decide(id, ok, tasksOf(p));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Page title="Approvals" sub="Nothing is executed until you approve it. Complete Human-in-the-Loop control.">
      <StatusBanner />
      <div className="glass !rounded-xl inline-flex p-1">
        {['pending', 'approved', 'rejected'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={'rounded-lg px-4 py-1.5 text-sm font-semibold capitalize ' + (tab === t ? 'bg-brand-600 text-white' : '')}
          >
            {t} ({proposals.filter(p => p.status === t).length})
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {list.map(p => (
          <Card key={p.id}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-base">{p.title}</h3>
                <p className="text-xs text-ink/55">
                  {p.source || 'Agent Studio'} · {tm(p.created_at || p.created)}
                </p>
              </div>
              <span
                className={
                  'chip capitalize ' +
                  (p.status === 'approved'
                    ? 'bg-emerald-100 text-emerald-700'
                    : p.status === 'rejected'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-brand-100 text-brand-700')
                }
              >
                {p.status}
              </span>
            </div>

            {/* Execution Result Log (if already executed) */}
            {p.execution_result && (
              <div className="mb-3 rounded-xl bg-slate-50 p-2.5 text-xs text-ink/75 border border-slate-200">
                <strong>Execution Record:</strong> {p.execution_result.executed ? `Executed ${p.execution_result.successCount} operations successfully.` : p.execution_result.reason}
              </div>
            )}

            <div className="space-y-2">
              {tasksOf(p).map(t =>
                p.status === 'pending' ? (
                  <div key={t.id} className="flex flex-wrap gap-2 rounded-xl bg-white/60 p-2 border border-brand-100/50">
                    <input
                      className="inp flex-1 text-xs font-semibold"
                      value={t.title}
                      onChange={e => chg(p, t.id, 'title', e.target.value)}
                    />
                    <select
                      className="inp !w-auto !py-1 text-xs"
                      value={t.priority}
                      onChange={e => chg(p, t.id, 'priority', e.target.value)}
                    >
                      {['High', 'Medium', 'Low'].map(x => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      className="inp !w-auto !py-1 text-xs"
                      value={t.due}
                      onChange={e => chg(p, t.id, 'due', e.target.value)}
                    />
                  </div>
                ) : (
                  <div key={t.id} className="flex items-center gap-2 text-sm rounded-xl bg-white/50 p-2">
                    <Pri p={t.priority} />
                    <span className="truncate">{t.title}</span>
                    <span className="ml-auto text-xs text-ink/55 shrink-0">{fmtD(t.due)}</span>
                  </div>
                )
              )}
            </div>

            {p.status === 'pending' && (
              <div className="mt-4 flex gap-2">
                <button
                  className="btn flex-1"
                  disabled={busyId === p.id}
                  onClick={() => handleDecision(p.id, true)}
                >
                  <Check size={16} />
                  {busyId === p.id ? 'Executing…' : 'Approve & Execute'}
                </button>
                <button
                  className="btn2 flex-1 !text-rose-600 hover:!bg-rose-50"
                  disabled={busyId === p.id}
                  onClick={() => handleDecision(p.id, false)}
                >
                  <X size={16} />
                  Reject Plan
                </button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {!list.length && <Empty text={`No ${tab} proposals. Generate a plan in Agent Studio to review.`} />}
    </Page>
  );
}

// ==========================================
// 5. ACTIVITY PAGE
// ==========================================
export function ActivityPage() {
  const { activity } = useApp();
  const [f, setF] = useState('All');
  const list = activity.filter(a => f === 'All' || a.status === f);
  const cls = {
    Completed: 'bg-emerald-100 text-emerald-700',
    Pending: 'bg-amber-100 text-amber-700',
    Rejected: 'bg-rose-100 text-rose-600',
    Cancelled: 'bg-slate-100 text-slate-600',
    Failed: 'bg-rose-100 text-rose-700'
  };

  return (
    <Page
      title="Activity"
      sub="Every task, plan and approval action, recorded persistently in the database."
      right={
        <select className="inp !w-auto" value={f} onChange={e => setF(e.target.value)}>
          {['All', 'Completed', 'Pending', 'Rejected', 'Cancelled', 'Failed'].map(x => (
            <option key={x}>{x}</option>
          ))}
        </select>
      }
    >
      <StatusBanner />
      <Card>
        <div className="relative space-y-5 border-l-2 border-brand-100 pl-6 my-2">
          {list.map(a => (
            <div key={a.id} className="relative">
              <i className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-500 shadow-sm" />
              <div className="flex flex-wrap items-center gap-2">
                <b>{a.title}</b>
                <span className={'chip ' + (cls[a.status] || 'bg-slate-100 text-slate-600')}>
                  {a.status}
                </span>
              </div>
              <div className="text-sm text-ink/65">{a.detail}</div>
              <div className="text-xs text-ink/45">
                {a.source} · {tm(a.at || a.timestamp)}
              </div>
            </div>
          ))}
          {!list.length && <Empty text="No activity found for this filter." />}
        </div>
      </Card>
    </Page>
  );
}

// ==========================================
// 6. CALENDAR VIEW
// ==========================================
export function CalendarPage() {
  const { tasks } = useApp();
  const [ym, setYm] = useState([2026, 10]); // November 2026 (base month)
  const [sel, setSel] = useState(TODAY);
  const [y, m] = ym;

  const first = new Date(y, m, 1).getDay();
  const n = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array(n).keys()].map(x => (x === null ? null : x + 1));
  const mv = d => {
    const x = new Date(y, m + d, 1);
    setYm([x.getFullYear(), x.getMonth()]);
  };

  return (
    <Page
      title="Calendar View"
      sub="Live tasks plotted on their due dates."
      right={
        <div className="flex items-center gap-2">
          <button className="btn2 !px-2" onClick={() => mv(-1)} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <b className="w-32 text-center">{MONTHS[m]} {y}</b>
          <button className="btn2 !px-2" onClick={() => mv(1)} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
      }
    >
      <StatusBanner />
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <Card className="!p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink/55 pb-2">
            {DAYS.map(d => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="min-h-[64px] rounded-xl bg-transparent" />;
              const k = iso(y, m, d);
              const ts = tasks.filter(t => t.due === k);
              return (
                <button
                  key={i}
                  onClick={() => setSel(k)}
                  className={
                    'min-h-[64px] rounded-xl p-1.5 text-left text-xs transition hover:bg-brand-50 ' +
                    (sel === k ? 'ring-2 ring-brand-500 bg-white shadow-sm' : 'bg-white/50') +
                    (k === TODAY ? ' font-extrabold text-brand-700' : '')
                  }
                >
                  <span className={k === TODAY ? 'inline-block rounded-full bg-brand-100 px-1.5 text-brand-700' : ''}>
                    {d}
                  </span>
                  {ts.slice(0, 2).map(t => (
                    <div
                      key={t.id}
                      className={
                        'mt-0.5 hidden truncate rounded px-1 text-[10px] font-medium sm:block ' +
                        (t.status === 'done' ? 'bg-slate-100 text-slate-500 line-through' : 'bg-brand-100 text-brand-700')
                      }
                    >
                      {t.title}
                    </div>
                  ))}
                  {ts.length > 0 && <i className="mt-1 block h-1.5 w-1.5 rounded-full bg-brand-500 sm:hidden" />}
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 font-bold">{fmtD(sel)}</h3>
          <div className="space-y-2">
            {tasks.filter(t => t.due === sel).map(t => (
              <div key={t.id} className="rounded-xl bg-white/80 p-3 text-sm border border-brand-100/50">
                <b className={t.status === 'done' ? 'line-through text-ink/50' : ''}>{t.title}</b>
                <div className="mt-1 flex gap-2">
                  <Pri p={t.priority} />
                  <span className="text-xs text-ink/55">{t.project}</span>
                </div>
              </div>
            ))}
            {!tasks.some(t => t.due === sel) && <Empty text="Nothing due on this date." />}
          </div>
        </Card>
      </div>
    </Page>
  );
}

// ==========================================
// 7. QUICK ACTIONS
// ==========================================
export function Quick() {
  const nav = useNavigate();
  const A = [
    [Globe, 'Analyze Webpage', 'Analyze this webpage and extract deadlines and requirements'],
    [CalendarDays, 'Plan My Week', 'Plan my week'],
    [ListChecks, 'Create Checklist', 'Create a checklist for my hackathon submission'],
    [CalendarClock, 'Reschedule Overdue Tasks', 'Reschedule overdue tasks']
  ];

  return (
    <Page title="Quick Actions" sub="One click opens Agent Studio with the prompt ready to run.">
      <StatusBanner />
      <div className="grid gap-4 sm:grid-cols-2">
        {A.map(([I, l, c]) => (
          <button key={l} onClick={() => nav('/agent?cmd=' + encodeURIComponent(c))} className="text-left">
            <Card className="hov h-full">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-600">
                <I size={24} />
              </span>
              <h3 className="mt-3 text-lg font-bold">{l}</h3>
              <p className="text-sm text-ink/60">“{c}”</p>
            </Card>
          </button>
        ))}
      </div>
    </Page>
  );
}

// ==========================================
// 8. ANALYTICS
// ==========================================
export function Analytics() {
  const { tasks, activity } = useApp();
  const done = tasks.filter(t => t.status === 'done').length;
  const rate = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const pri = ['High', 'Medium', 'Low'].map(p => ({
    name: p,
    value: tasks.filter(t => t.priority === p).length
  }));

  const proj = [...new Set(tasks.map(t => t.project || 'General'))].map(p => {
    const a = tasks.filter(t => (t.project || 'General') === p);
    return {
      name: p,
      pct: a.length > 0 ? Math.round((a.filter(t => t.status === 'done').length / a.length) * 100) : 0
    };
  });

  return (
    <Page title="Analytics" sub="Live statistics computed from your database records.">
      <StatusBanner />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Completion rate', rate + '%'],
          ['Total tasks', tasks.length],
          ['Logged actions', activity.length]
        ].map(([l, v]) => (
          <Card key={l} className="hov">
            <div className="text-sm text-ink/60">{l}</div>
            <b className="text-4xl">{v}</b>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <Title icon={BarChart3}>Tasks due by weekday</Title>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={weekly(tasks)}>
                <CartesianGrid vertical={false} stroke="#ece3ff" />
                <XAxis dataKey="d" />
                <YAxis allowDecimals={false} width={24} />
                <Tooltip />
                <Bar dataKey="n" name="Tasks" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <Title>Priority distribution</Title>
          <Donut data={pri} total={tasks.length} />
        </Card>

        <Card className="lg:col-span-2">
          <Title>Project progress</Title>
          <div className="space-y-3">
            {proj.map(p => (
              <div key={p.name}>
                <div className="flex justify-between text-sm">
                  <b>{p.name}</b>
                  <span>{p.pct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-brand-100">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500"
                    style={{ width: p.pct + '%' }}
                  />
                </div>
              </div>
            ))}
            {!proj.length && <Empty text="No projects found." />}
          </div>
        </Card>
      </div>
    </Page>
  );
}

// ==========================================
// 9. SETTINGS
// ==========================================
export function SettingsPage() {
  const { settings, saveSettings, reset } = useApp();
  const [v, setV] = useState(settings);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setV(settings);
  }, [settings]);

  const u = k => e =>
    setV({
      ...v,
      [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value
    });

  return (
    <Page title="Settings" sub="Preferences persisted through backend database.">
      <StatusBanner />
      <Card className="max-w-xl space-y-4">
        {[
          ['name', 'Name'],
          ['email', 'Email'],
          ['role', 'Role']
        ].map(([k, l]) => (
          <label key={k} className="block text-sm font-semibold">
            {l}
            <input className="inp mt-1" value={v[k] || ''} onChange={u(k)} />
          </label>
        ))}
        <label className="block text-sm font-semibold">
          Week starts on
          <select className="inp mt-1" value={v.weekStart} onChange={u('weekStart')}>
            <option>Mon</option>
            <option>Sun</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={v.notify} onChange={u('notify')} />
          Show approval reminders
        </label>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            className="btn"
            onClick={async () => {
              await saveSettings(v);
              setOk(true);
              setTimeout(() => setOk(false), 2000);
            }}
          >
            Save changes
          </button>
          <button className="btn2 !text-rose-600" onClick={() => reset()}>
            Reload database state
          </button>
          {ok && <span className="self-center text-sm font-semibold text-emerald-600">Saved</span>}
        </div>
      </Card>
    </Page>
  );
}

// ==========================================
// 10. GET EXTENSION (INFORMATIONAL PREVIEW)
// ==========================================
export function Extension() {
  return (
    <Page
      title="Get Extension"
      sub="Turn any webpage into an action plan."
      right={
        <button className="btn !cursor-not-allowed opacity-70" disabled>
          <Download size={16} />Coming Soon
        </button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        {[
          [Globe, 'Reads the page you’re on', 'Pulls deadlines, requirements and links from hackathon and internship pages.'],
          [Shield, 'You stay in control', 'Every plan waits for your approval before tasks are created.'],
          [Zap, 'One-click to tasks', 'Send the plan straight to My Space.']
        ].map(([I, t, d]) => (
          <Card key={t} className="hov">
            <I className="text-brand-600" size={28} />
            <h3 className="mt-3 font-bold">{t}</h3>
            <p className="text-sm text-ink/60">{d}</p>
          </Card>
        ))}
      </div>
      <Card>
        <Title icon={Chrome}>How installation will work</Title>
        <ol className="space-y-3">
          {[
            'Download the extension package when it is released.',
            'Open chrome://extensions and enable Developer mode.',
            'Choose Load unpacked and select the folder.',
            'Pin SaarthiFlow and click it on any webpage.'
          ].map((s, i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-ink/50">The extension is not built yet. This page is a preview.</p>
      </Card>
    </Page>
  );
}
