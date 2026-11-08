alter table public.user_skills
  add column if not exists security_bundle_hash text,
  add column if not exists security_bundle_manifest jsonb;

create index if not exists user_skills_security_bundle_hash_idx
  on public.user_skills (security_bundle_hash)
  where security_bundle_hash is not null;
