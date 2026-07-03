-- Schema for the Supabase Task Board demo.
-- Apply with:  docker exec -i supabase-db psql -U postgres -d postgres < schema.sql

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id          bigint generated always as identity primary key,
  title       text not null check (char_length(title) between 1 and 200),
  status      text not null default 'todo'   check (status in ('todo','doing','done')),
  priority    text not null default 'medium' check (priority in ('low','medium','high')),
  created_at  timestamptz not null default now()
);

-- Auth attribution (added if upgrading an older demo db)
alter table public.tasks add column if not exists created_by uuid default auth.uid();
alter table public.tasks add column if not exists creator   text;
-- Storage attachment
alter table public.tasks add column if not exists attachment_path text;
alter table public.tasks add column if not exists attachment_name text;

-- RLS: this is now a shared board that requires login. Any authenticated user
-- may read/write; anonymous (unauthenticated) clients are blocked.
alter table public.tasks enable row level security;
drop policy if exists "demo anon full access" on public.tasks;
drop policy if exists "authenticated full access" on public.tasks;
create policy "authenticated full access" on public.tasks
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Activity log (written by a trigger, streamed over Realtime)
-- ---------------------------------------------------------------------------
create table if not exists public.activity_log (
  id         bigint generated always as identity primary key,
  action     text not null,
  detail     text,
  actor      text,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;
drop policy if exists "authenticated read activity" on public.activity_log;
create policy "authenticated read activity" on public.activity_log
  for select to authenticated using (true);

create or replace function public.log_task_activity()
returns trigger language plpgsql security definer as $$
declare who text;
begin
  if (tg_op = 'INSERT') then
    who := coalesce(new.creator, 'someone');
    insert into public.activity_log(action, detail, actor)
      values ('created', new.title, who);
  elsif (tg_op = 'UPDATE') then
    who := coalesce(new.creator, old.creator, 'someone');
    if new.status is distinct from old.status then
      insert into public.activity_log(action, detail, actor)
        values ('moved', new.title || ' → ' || new.status, who);
    end if;
  elsif (tg_op = 'DELETE') then
    who := coalesce(old.creator, 'someone');
    insert into public.activity_log(action, detail, actor)
      values ('deleted', old.title, who);
    return old;
  end if;
  return new;
end $$;

drop trigger if exists trg_task_activity on public.tasks;
create trigger trg_task_activity
  after insert or update or delete on public.tasks
  for each row execute function public.log_task_activity();

-- ---------------------------------------------------------------------------
-- Stats RPC (Postgres function callable from the client)
-- ---------------------------------------------------------------------------
create or replace function public.task_stats()
returns json language sql stable security definer as $$
  select json_build_object(
    'total',      count(*),
    'todo',       count(*) filter (where status = 'todo'),
    'doing',      count(*) filter (where status = 'doing'),
    'done',       count(*) filter (where status = 'done'),
    'completion', case when count(*) = 0 then 0
                       else round(100.0 * count(*) filter (where status = 'done') / count(*))
                  end
  ) from public.tasks;
$$;
grant execute on function public.task_stats() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Storage bucket for task attachments
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('task-files', 'task-files', true)
  on conflict (id) do update set public = true;

drop policy if exists "task-files read"   on storage.objects;
drop policy if exists "task-files write"  on storage.objects;
drop policy if exists "task-files update" on storage.objects;
drop policy if exists "task-files delete" on storage.objects;
create policy "task-files read"   on storage.objects for select using (bucket_id = 'task-files');
create policy "task-files write"  on storage.objects for insert to authenticated with check (bucket_id = 'task-files');
create policy "task-files update" on storage.objects for update to authenticated using (bucket_id = 'task-files');
create policy "task-files delete" on storage.objects for delete to authenticated using (bucket_id = 'task-files');

-- ---------------------------------------------------------------------------
-- Realtime: broadcast row changes for both tables
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.activity_log;
exception when duplicate_object then null; end $$;

-- Seed a few rows if the board is empty
insert into public.tasks (title, status, priority, creator)
select *, 'Demo' from (values
  ('Set up Supabase locally', 'done', 'high'),
  ('Design the task board UI', 'doing', 'medium'),
  ('Wire up realtime updates', 'todo', 'high'),
  ('Write demo documentation', 'todo', 'low')
) as v(title,status,priority)
where not exists (select 1 from public.tasks);
