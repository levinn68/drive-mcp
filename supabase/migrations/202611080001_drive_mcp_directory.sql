-- DRIVE MCP directory and private custom endpoints
create table if not exists public.mcp_registry_sources (
  id text primary key,
  name text not null,
  base_url text not null,
  source_type text not null default 'official_registry',
  enabled boolean not null default true,
  last_synced_at timestamptz,
  last_sync_status text not null default 'never',
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.mcp_servers (
  id text primary key,
  server_name text not null,
  version text not null,
  title text,
  description text not null default '',
  repository_url text,
  website_url text,
  transport_types text[] not null default '{}',
  packages jsonb not null default '[]'::jsonb,
  remotes jsonb not null default '[]'::jsonb,
  registry_metadata jsonb not null default '{}'::jsonb,
  source_id text not null references public.mcp_registry_sources(id),
  source_status text not null default 'active',
  trust_level text not null default 'unverified',
  is_latest boolean not null default false,
  published_at timestamptz,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(server_name, version)
);
create index if not exists mcp_servers_name_search_idx on public.mcp_servers using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(server_name,'') || ' ' || coalesce(description,'')));
create index if not exists mcp_servers_latest_idx on public.mcp_servers (is_latest, server_name);
create index if not exists mcp_servers_source_idx on public.mcp_servers (source_id, updated_at desc);
create table if not exists public.mcp_registry_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.mcp_registry_sources(id),
  status text not null check (status in ('running','success','partial','failed')),
  pages_fetched integer not null default 0,
  records_seen integer not null default 0,
  records_upserted integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create table if not exists public.user_custom_mcp_servers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  endpoint_url text not null,
  transport text not null default 'streamable_http' check (transport in ('streamable_http')),
  auth_type text not null default 'none' check (auth_type in ('none','bearer','oauth2','custom_header')),
  credential_secret_id uuid,
  status text not null default 'pending' check (status in ('pending','verified','error','disabled')),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mcp_registry_sources enable row level security;
alter table public.mcp_servers enable row level security;
alter table public.mcp_registry_sync_runs enable row level security;
alter table public.user_custom_mcp_servers enable row level security;
drop policy if exists "Registry sources are publicly readable" on public.mcp_registry_sources;
create policy "Registry sources are publicly readable" on public.mcp_registry_sources for select to anon, authenticated using (enabled = true);
drop policy if exists "MCP directory is publicly readable" on public.mcp_servers;
create policy "MCP directory is publicly readable" on public.mcp_servers for select to anon, authenticated using (source_status <> 'deleted');
drop policy if exists "Users read their own custom MCP servers" on public.user_custom_mcp_servers;
create policy "Users read their own custom MCP servers" on public.user_custom_mcp_servers for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users create their own custom MCP servers" on public.user_custom_mcp_servers;
create policy "Users create their own custom MCP servers" on public.user_custom_mcp_servers for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users update their own custom MCP servers" on public.user_custom_mcp_servers;
create policy "Users update their own custom MCP servers" on public.user_custom_mcp_servers for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users delete their own custom MCP servers" on public.user_custom_mcp_servers;
create policy "Users delete their own custom MCP servers" on public.user_custom_mcp_servers for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.mcp_registry_sync_runs from anon, authenticated;
revoke insert, update, delete on public.mcp_registry_sources, public.mcp_servers from anon, authenticated;
grant select on public.mcp_registry_sources, public.mcp_servers to anon, authenticated;
grant select, insert, update, delete on public.user_custom_mcp_servers to authenticated;
insert into public.mcp_registry_sources (id,name,base_url,source_type)
values ('official-mcp-registry','Official MCP Registry','https://registry.modelcontextprotocol.io','official_registry')
on conflict (id) do update set name=excluded.name,base_url=excluded.base_url,updated_at=now();
