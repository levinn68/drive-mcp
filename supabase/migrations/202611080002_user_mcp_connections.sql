-- Per-user MCP enablement. A user's selection never changes another user's connections.
create table if not exists public.user_mcp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  registry_server_id text references public.mcp_servers(id) on delete cascade,
  custom_server_id uuid references public.user_custom_mcp_servers(id) on delete cascade,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_mcp_connections_one_target check (
    (registry_server_id is not null and custom_server_id is null)
    or (registry_server_id is null and custom_server_id is not null)
  )
);
create unique index if not exists user_mcp_connections_registry_unique
  on public.user_mcp_connections(user_id, registry_server_id)
  ;
create unique index if not exists user_mcp_connections_custom_unique
  on public.user_mcp_connections(user_id, custom_server_id)
  ;
create index if not exists user_mcp_connections_user_enabled_idx
  on public.user_mcp_connections(user_id, enabled);
alter table public.user_mcp_connections enable row level security;
revoke all on public.user_mcp_connections from anon;
grant select, insert, update, delete on public.user_mcp_connections to authenticated;
drop policy if exists "Users read their own MCP connections" on public.user_mcp_connections;
create policy "Users read their own MCP connections" on public.user_mcp_connections
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users add their own MCP connections" on public.user_mcp_connections;
create policy "Users add their own MCP connections" on public.user_mcp_connections
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (
      (registry_server_id is not null and custom_server_id is null)
      or
      (registry_server_id is null and custom_server_id is not null
       and exists (
         select 1 from public.user_custom_mcp_servers c
         where c.id = custom_server_id and c.user_id = (select auth.uid())
       ))
    )
  );
drop policy if exists "Users update their own MCP connections" on public.user_mcp_connections;
drop policy if exists "Users update their own MCP connections" on public.user_mcp_connections;
create policy "Users update their own MCP connections" on public.user_mcp_connections
  for update to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      (registry_server_id is not null and custom_server_id is null)
      or
      (registry_server_id is null and custom_server_id is not null
       and exists (
         select 1 from public.user_custom_mcp_servers c
         where c.id = custom_server_id and c.user_id = (select auth.uid())
       ))
    )
  );
drop policy if exists "Users delete their own MCP connections" on public.user_mcp_connections;
create policy "Users delete their own MCP connections" on public.user_mcp_connections
  for delete to authenticated using ((select auth.uid()) = user_id);
