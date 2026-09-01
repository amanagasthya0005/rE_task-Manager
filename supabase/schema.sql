-- rE Task Manager / Supabase setup
-- Run this whole file once in Supabase SQL Editor.

create table if not exists public.team_members (
  id text primary key,
  name text not null,
  role text not null default 'Team member',
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  title text not null,
  description text not null default '',
  assignee_id text references public.team_members(id) on delete set null,
  status text not null check (status in ('backlog','todo','in-progress','in-review','done')),
  priority text not null check (priority in ('urgent','high','medium','low')),
  due_date date,
  labels jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity (
  id text primary key,
  type text not null,
  message text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id text primary key,
  task_id text not null references public.tasks(id) on delete cascade,
  author text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists tasks_assignee_idx on public.tasks(assignee_id);
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_updated_idx on public.tasks(updated_at desc);
create index if not exists comments_task_idx on public.comments(task_id);

grant select on public.team_members, public.tasks, public.activity, public.comments to anon;
grant select, insert, update, delete on public.team_members, public.tasks, public.activity, public.comments to authenticated;

alter table public.team_members enable row level security;
alter table public.tasks enable row level security;
alter table public.activity enable row level security;
alter table public.comments enable row level security;

drop policy if exists "Guests can read team" on public.team_members;
drop policy if exists "Editor can manage team" on public.team_members;
create policy "Guests can read team" on public.team_members for select to anon, authenticated using (true);
create policy "Editor can manage team" on public.team_members for all to authenticated
  using ((auth.jwt() ->> 'email') = 'rE_Task@re-task.local')
  with check ((auth.jwt() ->> 'email') = 'rE_Task@re-task.local');

drop policy if exists "Guests can read tasks" on public.tasks;
drop policy if exists "Editor can manage tasks" on public.tasks;
create policy "Guests can read tasks" on public.tasks for select to anon, authenticated using (true);
create policy "Editor can manage tasks" on public.tasks for all to authenticated
  using ((auth.jwt() ->> 'email') = 'rE_Task@re-task.local')
  with check ((auth.jwt() ->> 'email') = 'rE_Task@re-task.local');

drop policy if exists "Guests can read activity" on public.activity;
drop policy if exists "Editor can manage activity" on public.activity;
create policy "Guests can read activity" on public.activity for select to anon, authenticated using (true);
create policy "Editor can manage activity" on public.activity for all to authenticated
  using ((auth.jwt() ->> 'email') = 'rE_Task@re-task.local')
  with check ((auth.jwt() ->> 'email') = 'rE_Task@re-task.local');

drop policy if exists "Guests can read comments" on public.comments;
drop policy if exists "Editor can manage comments" on public.comments;
create policy "Guests can read comments" on public.comments for select to anon, authenticated using (true);
create policy "Editor can manage comments" on public.comments for all to authenticated
  using ((auth.jwt() ->> 'email') = 'rE_Task@re-task.local')
  with check ((auth.jwt() ->> 'email') = 'rE_Task@re-task.local');

-- Seed team members FIRST because tasks reference them.
insert into public.team_members (id, name, role) values
('member-aman','Aman','Category & Strategy'),
('member-neha','Neha','Brand'),
('member-rohan','Rohan','Performance'),
('member-simran','Simran','Creative')
on conflict (id) do nothing;

-- Seed demo tasks AFTER team members exist.
insert into public.tasks
(id,title,description,assignee_id,status,priority,due_date,labels,history)
values
('task-1','Map competitor massage gun range','Document competitor products, positioning and price architecture.','member-aman','in-progress','high','2026-09-05','["Research","Competitor"]'::jsonb,'[]'::jsonb),
('task-2','Build recovery education content buckets','Define problem-agitation, educational and symptom-led content themes.','member-neha','todo','medium','2026-09-07','["Content","Education"]'::jsonb,'[]'::jsonb),
('task-3','Review performance creative hooks','Shortlist high-intent hooks for aware and unaware audiences.','member-simran','in-review','high','2026-09-03','["Creative","Performance"]'::jsonb,'[]'::jsonb),
('task-4','Finalize recovery product comparison sheet','Complete the competitor manufacturer and comparison-product framework.','member-rohan','backlog','low','2026-09-12','["Research"]'::jsonb,'[]'::jsonb),
('task-5','Define 10-minute reset proposition','Translate the core proposition into clear consumer-facing language.','member-aman','done','urgent','2026-08-30','["Strategy","Brand"]'::jsonb,'[]'::jsonb)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='team_members') then
    execute 'alter publication supabase_realtime add table public.team_members';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tasks') then
    execute 'alter publication supabase_realtime add table public.tasks';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='activity') then
    execute 'alter publication supabase_realtime add table public.activity';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='comments') then
    execute 'alter publication supabase_realtime add table public.comments';
  end if;
end $$;
