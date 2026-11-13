import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const C = createContext();
export const useApp = () => useContext(C);

export const uid = () => Math.random().toString(36).slice(2, 9);
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtD = d => {
  if (!d) return 'No date';
  const [, m, day] = d.split('-');
  return MONTHS[+m - 1] + ' ' + +day;
};
export const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export const TODAY = iso(2026, 10, 14);

export function Store({ children }) {
  const [tasks, setTasks] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [activity, setActivity] = useState([]);
  const [projects, setProjects] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [settings, setSettings] = useState({
    name: 'Riya',
    email: 'riya@example.com',
    role: 'Student Developer',
    weekStart: 'Mon',
    notify: true,
    demo: false
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backendConnected, setBackendConnected] = useState(false);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = uid();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Fetch full state from backend
  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const [tList, pList, aList, prjList, sData, anaData] = await Promise.all([
        api.getTasks(),
        api.getApprovals(),
        api.getActivity(),
        api.getProjects(),
        api.getSettings().catch(() => settings),
        api.getAnalytics().catch(() => null)
      ]);

      setTasks(tList || []);
      setProposals(pList || []);
      setActivity(aList || []);
      setProjects(prjList || []);
      if (sData) setSettings(sData);
      if (anaData) setAnalytics(anaData);
      setBackendConnected(true);
    } catch (err) {
      console.error('[Store] Failed to load data from backend:', err);
      setError(err.message);
      setBackendConnected(false);
    } finally {
      setLoading(false);
    }
  }, [settings]);

  useEffect(() => {
    refresh();
  }, []);

  // Task Mutations
  const addTask = async (t) => {
    try {
      const created = await api.createTask(t);
      showToast(`Task created: "${created.title}"`, 'success');
      await refresh(true);
      return created;
    } catch (err) {
      showToast(`Failed to create task: ${err.message}`, 'error');
      throw err;
    }
  };

  const updateTask = async (t) => {
    try {
      const updated = await api.updateTask(t.id, t);
      showToast(`Task updated: "${updated.title}"`, 'success');
      await refresh(true);
      return updated;
    } catch (err) {
      showToast(`Failed to update task: ${err.message}`, 'error');
      throw err;
    }
  };

  const deleteTask = async (id) => {
    try {
      await api.deleteTask(id);
      showToast('Task removed from workspace', 'info');
      await refresh(true);
    } catch (err) {
      showToast(`Failed to delete task: ${err.message}`, 'error');
      throw err;
    }
  };

  const toggleTask = async (id) => {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    const newStatus = t.status === 'done' ? 'todo' : 'done';
    try {
      await api.updateTask(id, { status: newStatus });
      showToast(newStatus === 'done' ? `Completed "${t.title}"` : `Reopened "${t.title}"`, 'success');
      await refresh(true);
    } catch (err) {
      showToast(`Failed to toggle task: ${err.message}`, 'error');
    }
  };

  // Proposals & Approvals
  const addProposal = async (p) => {
    try {
      const result = await api.generatePlan({ command: p.title });
      showToast('Action plan created and sent to Approvals!', 'success');
      await refresh(true);
      return result;
    } catch (err) {
      showToast(`Failed to send proposal: ${err.message}`, 'error');
      throw err;
    }
  };

  const decide = async (id, ok, editedTasks) => {
    try {
      if (ok) {
        const result = await api.approveProposal(id, editedTasks);
        showToast(`Approved! Executed ${result.summary?.successCount || 0} task actions in database.`, 'success');
        await refresh(true);
        return result;
      } else {
        const result = await api.rejectProposal(id);
        showToast('Proposal rejected. Zero database mutations.', 'info');
        await refresh(true);
        return result;
      }
    } catch (err) {
      showToast(`Decision execution error: ${err.message}`, 'error');
      throw err;
    }
  };

  const saveSettings = async (v) => {
    try {
      const saved = await api.saveSettings(v);
      setSettings(saved);
      showToast('Settings saved to backend', 'success');
      await refresh(true);
      return saved;
    } catch (err) {
      showToast(`Failed to save settings: ${err.message}`, 'error');
      throw err;
    }
  };

  const reset = async () => {
    try {
      // Re-seed backend by calling initial task reset or refresh
      showToast('Reloading workspace data...', 'info');
      await refresh();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const value = {
    tasks,
    proposals,
    activity,
    projects,
    analytics,
    settings,
    loading,
    error,
    backendConnected,
    toasts,
    showToast,
    removeToast,
    refresh,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    addProposal,
    decide,
    saveSettings,
    reset
  };

  return (
    <C.Provider value={value}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold backdrop-blur-xl border transition-all animate-bounce-short ${
              t.type === 'error'
                ? 'bg-rose-500/95 text-white border-rose-400'
                : t.type === 'success'
                ? 'bg-brand-600/95 text-white border-brand-400'
                : 'bg-white/95 text-ink border-brand-200'
            }`}
          >
            <span>{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="text-xs opacity-75 hover:opacity-100 ml-2"
              aria-label="Dismiss toast"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </C.Provider>
  );
}
