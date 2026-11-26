-- Expand DRIVE MCP Marketplace with multi-source MCP registries and indexed Skills catalog

insert into public.mcp_registry_sources (id, name, base_url, source_type, enabled)
values
  ('official-mcp-registry', 'Official MCP Registry', 'https://registry.modelcontextprotocol.io', 'official_registry', true),
  ('glama-mcp-directory', 'Glama MCP Directory', 'https://glama.ai/api/mcp/v1/servers', 'directory_api', true),
  ('github-mcp-discovery', 'GitHub MCP Discovery', 'https://api.github.com', 'github_crawler', true),
  ('community-submissions', 'DRIVE Community Submissions', 'https://drive-mcp-five.vercel.app', 'community', true)
on conflict (id) do update
set name = excluded.name,
    base_url = excluded.base_url,
    source_type = excluded.source_type,
    enabled = excluded.enabled,
    updated_at = now();

create table if not exists public.skill_catalog (
  id text primary key,
  slug text not null,
  name text not null,
  description text not null default '',
  category text not null default 'other',
  author text,
  repository text not null,
  skill_path text,
  source_url text,
  source_id text not null default 'skillsdirectory',
  stars integer not null default 0,
  install_count integer not null default 0,
  verified boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists skill_catalog_search_idx
  on public.skill_catalog
  using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(slug, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, '')));

create index if not exists skill_catalog_rank_idx
  on public.skill_catalog (verified desc, stars desc, install_count desc, updated_at desc);

create index if not exists skill_catalog_source_idx
  on public.skill_catalog (source_id, updated_at desc);

alter table public.skill_catalog enable row level security;

drop policy if exists "Skill catalog is publicly readable" on public.skill_catalog;
create policy "Skill catalog is publicly readable"
  on public.skill_catalog
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.skill_catalog from anon, authenticated;
grant select on public.skill_catalog to anon, authenticated;
