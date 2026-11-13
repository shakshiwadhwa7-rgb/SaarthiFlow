-- SaarthiFlow Supabase PostgreSQL Schema
-- Run this script in the Supabase SQL Editor to initialize all required tables and indexes.

-- 1. Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    project TEXT NOT NULL DEFAULT 'General',
    priority TEXT NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
    status TEXT NOT NULL CHECK (status IN ('todo', 'doing', 'done')),
    due DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Action Proposals Table
CREATE TABLE IF NOT EXISTS public.proposals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'Agent Studio',
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
    execution_result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ
);

-- 4. Agent Runs Table
CREATE TABLE IF NOT EXISTS public.agent_runs (
    id TEXT PRIMARY KEY,
    command TEXT NOT NULL,
    status TEXT NOT NULL,
    raw_input TEXT,
    output_summary TEXT,
    proposal_id TEXT REFERENCES public.proposals(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Activity Logs Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Completed', 'Pending', 'Rejected', 'Cancelled', 'Failed')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. User Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON public.tasks(due);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON public.activity_logs(timestamp DESC);

-- Initial seed data for fresh database
INSERT INTO public.tasks (id, title, project, priority, status, due) VALUES
    ('t-seed-1', 'Submit GSSoC application', 'Open Source', 'High', 'todo', '2026-11-18'),
    ('t-seed-2', 'Complete Azure AI-900 practice', 'Learning', 'Medium', 'done', '2026-11-12'),
    ('t-seed-3', 'Build SaarthiFlow MVP', 'Hackathon', 'High', 'doing', '2026-11-20'),
    ('t-seed-4', 'Paper review for agents', 'Research', 'Medium', 'todo', '2026-11-22'),
    ('t-seed-5', 'HackOWASP registration', 'Hackathon', 'High', 'todo', '2026-11-17'),
    ('t-seed-6', 'Infosys Internship Course', 'Internships', 'Low', 'doing', '2026-11-25'),
    ('t-seed-7', 'DBMS Phase 2 submission', 'College', 'High', 'todo', '2026-12-02'),
    ('t-seed-8', 'Prepare demo video', 'Hackathon', 'Medium', 'todo', '2026-11-19')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.activity_logs (id, type, title, detail, source, status, timestamp) VALUES
    ('a-seed-1', 'Plan', 'Analyzed webpage', 'Extracted deadlines and requirements', 'Agent Studio', 'Completed', NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.settings (id, data) VALUES
    ('default', '{"name":"Riya","email":"riya@example.com","role":"Student Developer","weekStart":"Mon","notify":true,"demo":false}'::jsonb)
ON CONFLICT (id) DO NOTHING;
